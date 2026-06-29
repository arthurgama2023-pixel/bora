import '/auth/firebase_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'cadastrar_aluguel_model.dart';
export 'cadastrar_aluguel_model.dart';

class CadastrarAluguelWidget extends StatefulWidget {
  const CadastrarAluguelWidget({super.key});

  static String routeName = 'cadastrarAluguel';
  static String routePath = '/cadastrarAluguel';

  @override
  State<CadastrarAluguelWidget> createState() => _CadastrarAluguelWidgetState();
}

class _CadastrarAluguelWidgetState extends State<CadastrarAluguelWidget> {
  late CadastrarAluguelModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => CadastrarAluguelModel());

    _model.nomeDestinoTextController ??= TextEditingController();
    _model.nomeDestinoFocusNode ??= FocusNode();

    _model.valorTextController ??= TextEditingController();
    _model.valorFocusNode ??= FocusNode();

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: FlutterFlowTheme.of(context).primaryBackground,
        body: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(0.0, 32.0, 0.0, 0.0),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.max,
              children: [
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(16.0, 16.0, 0.0, 0.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    children: [
                      Container(
                        width: 45.0,
                        height: 45.0,
                        decoration: BoxDecoration(
                          color:
                              FlutterFlowTheme.of(context).secondaryBackground,
                          shape: BoxShape.circle,
                        ),
                        child: InkWell(
                          splashColor: Colors.transparent,
                          focusColor: Colors.transparent,
                          hoverColor: Colors.transparent,
                          highlightColor: Colors.transparent,
                          onTap: () async {
                            context.safePop();
                          },
                          child: Icon(
                            Icons.chevron_left_rounded,
                            color: FlutterFlowTheme.of(context).primaryText,
                            size: 32.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(16.0, 40.0, 0.0, 0.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    children: [
                      Text(
                        'Cadastrar pagamento.',
                        style: FlutterFlowTheme.of(context).bodyMedium.override(
                              font: GoogleFonts.roboto(
                                fontWeight: FontWeight.normal,
                                fontStyle: FlutterFlowTheme.of(context)
                                    .bodyMedium
                                    .fontStyle,
                              ),
                              fontSize: 24.0,
                              letterSpacing: 0.0,
                              fontWeight: FontWeight.normal,
                              fontStyle: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .fontStyle,
                            ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(16.0, 3.0, 0.0, 0.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    children: [
                      Text(
                        'preencha o fomulario com os dados de pagamento.',
                        style: FlutterFlowTheme.of(context).bodyMedium.override(
                              font: GoogleFonts.roboto(
                                fontWeight: FontWeight.normal,
                                fontStyle: FlutterFlowTheme.of(context)
                                    .bodyMedium
                                    .fontStyle,
                              ),
                              fontSize: 12.0,
                              letterSpacing: 0.0,
                              fontWeight: FontWeight.normal,
                              fontStyle: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .fontStyle,
                            ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 24.0, 0.0, 0.0),
                  child: Container(
                    width: 344.0,
                    height: 75.0,
                    decoration: BoxDecoration(
                      color: FlutterFlowTheme.of(context).accent1,
                      borderRadius: BorderRadius.circular(24.0),
                      border: Border.all(
                        color: FlutterFlowTheme.of(context).secondaryBackground,
                      ),
                    ),
                    alignment: AlignmentDirectional(0.0, 0.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.max,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Align(
                            alignment: AlignmentDirectional(-1.0, 0.0),
                            child: Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  8.0, 0.0, 8.0, 0.0),
                              child: FFButtonWidget(
                                onPressed: () async {
                                  final selectedMedia =
                                      await selectMediaWithSourceBottomSheet(
                                    context: context,
                                    allowPhoto: true,
                                    includeBlurHash: true,
                                  );
                                  if (selectedMedia != null &&
                                      selectedMedia.every((m) =>
                                          validateFileFormat(
                                              m.storagePath, context))) {
                                    safeSetState(() =>
                                        _model.isDataUploading_fotoComprovante =
                                            true);
                                    var selectedUploadedFiles =
                                        <FFUploadedFile>[];

                                    var downloadUrls = <String>[];
                                    try {
                                      showUploadMessage(
                                        context,
                                        'Uploading file...',
                                        showLoading: true,
                                      );
                                      selectedUploadedFiles = selectedMedia
                                          .map((m) => FFUploadedFile(
                                                name: m.storagePath
                                                    .split('/')
                                                    .last,
                                                bytes: m.bytes,
                                                height: m.dimensions?.height,
                                                width: m.dimensions?.width,
                                                blurHash: m.blurHash,
                                                originalFilename:
                                                    m.originalFilename,
                                              ))
                                          .toList();

                                      downloadUrls = (await Future.wait(
                                        selectedMedia.map(
                                          (m) async => await uploadData(
                                              m.storagePath, m.bytes),
                                        ),
                                      ))
                                          .where((u) => u != null)
                                          .map((u) => u!)
                                          .toList();
                                    } finally {
                                      ScaffoldMessenger.of(context)
                                          .hideCurrentSnackBar();
                                      _model.isDataUploading_fotoComprovante =
                                          false;
                                    }
                                    if (selectedUploadedFiles.length ==
                                            selectedMedia.length &&
                                        downloadUrls.length ==
                                            selectedMedia.length) {
                                      safeSetState(() {
                                        _model.uploadedLocalFile_fotoComprovante =
                                            selectedUploadedFiles.first;
                                        _model.uploadedFileUrl_fotoComprovante =
                                            downloadUrls.first;
                                      });
                                      showUploadMessage(context, 'Success!');
                                    } else {
                                      safeSetState(() {});
                                      showUploadMessage(
                                          context, 'Failed to upload data');
                                      return;
                                    }
                                  }
                                },
                                text: 'Carregar comprovante',
                                icon: Icon(
                                  Icons.linked_camera,
                                  size: 15.0,
                                ),
                                options: FFButtonOptions(
                                  height: 40.0,
                                  padding: EdgeInsetsDirectional.fromSTEB(
                                      16.0, 0.0, 16.0, 0.0),
                                  iconPadding: EdgeInsetsDirectional.fromSTEB(
                                      0.0, 0.0, 0.0, 0.0),
                                  iconColor:
                                      FlutterFlowTheme.of(context).primary,
                                  color: Color(0x000C84C5),
                                  textStyle: FlutterFlowTheme.of(context)
                                      .titleSmall
                                      .override(
                                        font: GoogleFonts.poppins(
                                          fontWeight:
                                              FlutterFlowTheme.of(context)
                                                  .titleSmall
                                                  .fontWeight,
                                          fontStyle:
                                              FlutterFlowTheme.of(context)
                                                  .titleSmall
                                                  .fontStyle,
                                        ),
                                        color: Colors.white,
                                        letterSpacing: 0.0,
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .titleSmall
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .titleSmall
                                            .fontStyle,
                                      ),
                                  elevation: 0.0,
                                  borderRadius: BorderRadius.circular(8.0),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 8.0, 0.0, 0.0),
                  child: Container(
                    width: 344.0,
                    height: 75.0,
                    decoration: BoxDecoration(
                      color: FlutterFlowTheme.of(context).accent1,
                      borderRadius: BorderRadius.circular(24.0),
                      border: Border.all(
                        color: FlutterFlowTheme.of(context).secondaryBackground,
                      ),
                    ),
                    alignment: AlignmentDirectional(0.0, 0.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.max,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                8.0, 0.0, 8.0, 0.0),
                            child: Container(
                              width: double.infinity,
                              child: TextFormField(
                                controller: _model.nomeDestinoTextController,
                                focusNode: _model.nomeDestinoFocusNode,
                                autofocus: false,
                                obscureText: false,
                                decoration: InputDecoration(
                                  isDense: true,
                                  labelStyle: FlutterFlowTheme.of(context)
                                      .bodyMedium
                                      .override(
                                        font: GoogleFonts.poppins(
                                          fontWeight:
                                              FlutterFlowTheme.of(context)
                                                  .bodyMedium
                                                  .fontWeight,
                                          fontStyle:
                                              FlutterFlowTheme.of(context)
                                                  .bodyMedium
                                                  .fontStyle,
                                        ),
                                        letterSpacing: 0.0,
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontStyle,
                                      ),
                                  hintText: 'Nome do proprietario',
                                  hintStyle: FlutterFlowTheme.of(context)
                                      .labelMedium
                                      .override(
                                        font: GoogleFonts.poppins(
                                          fontWeight:
                                              FlutterFlowTheme.of(context)
                                                  .labelMedium
                                                  .fontWeight,
                                          fontStyle:
                                              FlutterFlowTheme.of(context)
                                                  .labelMedium
                                                  .fontStyle,
                                        ),
                                        color: FlutterFlowTheme.of(context)
                                            .secondaryText,
                                        letterSpacing: 0.0,
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                  enabledBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: Color(0x00000000),
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: Color(0x00000000),
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  errorBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: FlutterFlowTheme.of(context).error,
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  focusedErrorBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: FlutterFlowTheme.of(context).error,
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  filled: true,
                                  fillColor: Colors.transparent,
                                  prefixIcon: Icon(
                                    Icons.people,
                                    color: FlutterFlowTheme.of(context).primary,
                                  ),
                                ),
                                style: FlutterFlowTheme.of(context)
                                    .bodyMedium
                                    .override(
                                      font: GoogleFonts.poppins(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                maxLines: null,
                                cursorColor:
                                    FlutterFlowTheme.of(context).primaryText,
                                validator: _model
                                    .nomeDestinoTextControllerValidator
                                    .asValidator(context),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 8.0, 0.0, 0.0),
                  child: Container(
                    width: 344.0,
                    height: 75.0,
                    decoration: BoxDecoration(
                      color: FlutterFlowTheme.of(context).accent1,
                      borderRadius: BorderRadius.circular(24.0),
                      border: Border.all(
                        color: FlutterFlowTheme.of(context).secondaryBackground,
                      ),
                    ),
                    alignment: AlignmentDirectional(0.0, 0.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.max,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                8.0, 0.0, 8.0, 0.0),
                            child: Container(
                              width: double.infinity,
                              child: TextFormField(
                                controller: _model.valorTextController,
                                focusNode: _model.valorFocusNode,
                                autofocus: false,
                                obscureText: false,
                                decoration: InputDecoration(
                                  isDense: true,
                                  labelStyle: FlutterFlowTheme.of(context)
                                      .bodyMedium
                                      .override(
                                        font: GoogleFonts.poppins(
                                          fontWeight:
                                              FlutterFlowTheme.of(context)
                                                  .bodyMedium
                                                  .fontWeight,
                                          fontStyle:
                                              FlutterFlowTheme.of(context)
                                                  .bodyMedium
                                                  .fontStyle,
                                        ),
                                        letterSpacing: 0.0,
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontStyle,
                                      ),
                                  alignLabelWithHint: false,
                                  hintText: 'Valor do aluguel',
                                  hintStyle: FlutterFlowTheme.of(context)
                                      .labelMedium
                                      .override(
                                        font: GoogleFonts.poppins(
                                          fontWeight:
                                              FlutterFlowTheme.of(context)
                                                  .labelMedium
                                                  .fontWeight,
                                          fontStyle:
                                              FlutterFlowTheme.of(context)
                                                  .labelMedium
                                                  .fontStyle,
                                        ),
                                        color: FlutterFlowTheme.of(context)
                                            .secondaryText,
                                        letterSpacing: 0.0,
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                  enabledBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: Color(0x00000000),
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: Color(0x00000000),
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  errorBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: FlutterFlowTheme.of(context).error,
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  focusedErrorBorder: OutlineInputBorder(
                                    borderSide: BorderSide(
                                      color: FlutterFlowTheme.of(context).error,
                                      width: 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(20.0),
                                  ),
                                  filled: true,
                                  fillColor: Colors.transparent,
                                  prefixIcon: Icon(
                                    Icons.attach_money_rounded,
                                    color: FlutterFlowTheme.of(context).primary,
                                    size: 24.0,
                                  ),
                                ),
                                style: FlutterFlowTheme.of(context)
                                    .bodyMedium
                                    .override(
                                      font: GoogleFonts.poppins(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .bodyMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                maxLines: null,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                cursorColor:
                                    FlutterFlowTheme.of(context).primaryText,
                                validator: _model.valorTextControllerValidator
                                    .asValidator(context),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 32.0, 0.0, 0.0),
                  child: Stack(
                    alignment: AlignmentDirectional(0.0, 0.0),
                    children: [
                      Padding(
                        padding: EdgeInsetsDirectional.fromSTEB(
                            16.0, 0.0, 16.0, 0.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.max,
                          children: [
                            Divider(
                              thickness: 2.0,
                              color: FlutterFlowTheme.of(context)
                                  .secondaryBackground,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding:
                        EdgeInsetsDirectional.fromSTEB(16.0, 24.0, 16.0, 16.0),
                    child: FFButtonWidget(
                      onPressed: () async {
                        FFAppState().valor = functions
                            .removerNumeros(_model.valorTextController.text)!
                            .toDouble();
                        safeSetState(() {});
                        FFAppState().preco = () {
                          if (FFAppState().valor < 2000.0) {
                            return 5;
                          } else if ((FFAppState().valor > 1999.0) &&
                              (FFAppState().valor < 3000.0)) {
                            return 7;
                          } else if ((FFAppState().valor > 2999.0) &&
                              (FFAppState().valor < 4000.0)) {
                            return 10;
                          } else if ((FFAppState().valor > 3999.0) &&
                              (FFAppState().valor < 5000.0)) {
                            return 12;
                          } else if ((FFAppState().valor > 4999.0) &&
                              (FFAppState().valor < 7500.0)) {
                            return 15;
                          } else if ((FFAppState().valor > 7499.0) &&
                              (FFAppState().valor < 10000.0)) {
                            return 20;
                          } else if ((FFAppState().valor > 9999.0) &&
                              (FFAppState().valor < 15000.0)) {
                            return 25;
                          } else if ((FFAppState().valor > 14999.0) &&
                              (FFAppState().valor < 20000.0)) {
                            return 40;
                          } else if ((FFAppState().valor > 19999.0) &&
                              (FFAppState().valor < 25000.0)) {
                            return 50;
                          } else if ((FFAppState().valor > 24999.0) &&
                              (FFAppState().valor < 30000.0)) {
                            return 65;
                          } else if ((FFAppState().valor > 29999.0) &&
                              (FFAppState().valor < 40000.0)) {
                            return 80;
                          } else if ((FFAppState().valor > 39999.0) &&
                              (FFAppState().valor < 50000.0)) {
                            return 100;
                          } else if ((FFAppState().valor > 49999.0) &&
                              (FFAppState().valor < 75000.0)) {
                            return 125;
                          } else if ((FFAppState().valor > 74999.0) &&
                              (FFAppState().valor < 100000.0)) {
                            return 180;
                          } else if (FFAppState().valor > 99999.0) {
                            return 250;
                          } else {
                            return 0;
                          }
                        }()
                            .toString();
                        safeSetState(() {});
                        FFAppState().valor = () {
                          if (FFAppState().valor < 2000.0) {
                            return 500;
                          } else if ((FFAppState().valor > 1999.0) &&
                              (FFAppState().valor < 3000.0)) {
                            return 700;
                          } else if ((FFAppState().valor > 2999.0) &&
                              (FFAppState().valor < 4000.0)) {
                            return 1000;
                          } else if ((FFAppState().valor > 3999.0) &&
                              (FFAppState().valor < 5000.0)) {
                            return 1200;
                          } else if ((FFAppState().valor > 4999.0) &&
                              (FFAppState().valor < 7500.0)) {
                            return 1500;
                          } else if ((FFAppState().valor > 7499.0) &&
                              (FFAppState().valor < 10000.0)) {
                            return 2000;
                          } else if ((FFAppState().valor > 9999.0) &&
                              (FFAppState().valor < 15000.0)) {
                            return 2500;
                          } else if ((FFAppState().valor > 14999.0) &&
                              (FFAppState().valor < 20000.0)) {
                            return 4000;
                          } else if ((FFAppState().valor > 19999.0) &&
                              (FFAppState().valor < 25000.0)) {
                            return 5000;
                          } else if ((FFAppState().valor > 24999.0) &&
                              (FFAppState().valor < 30000.0)) {
                            return 6500;
                          } else if ((FFAppState().valor > 29999.0) &&
                              (FFAppState().valor < 40000.0)) {
                            return 8000;
                          } else if ((FFAppState().valor > 39999.0) &&
                              (FFAppState().valor < 50000.0)) {
                            return 10000;
                          } else if ((FFAppState().valor > 49999.0) &&
                              (FFAppState().valor < 75000.0)) {
                            return 12500;
                          } else if ((FFAppState().valor > 74999.0) &&
                              (FFAppState().valor < 100000.0)) {
                            return 18000;
                          } else if (FFAppState().valor > 99999.0) {
                            return 25000;
                          } else {
                            return 0;
                          }
                        }()
                            .toDouble();
                        safeSetState(() {});
                        _model.apiCall = await CriarTranferenciaCall.call(
                          preco: FFAppState().valor.toString(),
                          cpf: valueOrDefault(currentUserDocument?.cpf, ''),
                          descricao: 'Aluguel',
                          cliente: currentUserDisplayName,
                          email: currentUserEmail,
                        );

                        if ((_model.apiCall?.succeeded ?? true)) {
                          var alugueisRecordReference =
                              AlugueisRecord.collection.doc();
                          await alugueisRecordReference
                              .set(createAlugueisRecordData(
                            titulo:
                                'Pago ${dateTimeFormat("MMMM", getCurrentTimestamp)}  CPF:${valueOrDefault(currentUserDocument?.cpf, '')}',
                            valor: functions.trocarVirgulaCopy(
                                _model.valorTextController.text),
                            nomeProprietario:
                                _model.nomeDestinoTextController.text,
                            status: 'Aguardando aprovação',
                            isPago: false,
                            dono: currentUserReference,
                            pontos: (functions.removerNumeros(
                                    _model.valorTextController.text)!) +
                                (functions.calcularpontos(FFAppState().valor)!),
                            dataPagamento: getCurrentTimestamp,
                            valorComAdd: FFAppState().valor / 100,
                            comprovante: _model.uploadedFileUrl_fotoComprovante,
                            idPagamento: CriarTranferenciaCall.idOrdem(
                              (_model.apiCall?.jsonBody ?? ''),
                            ),
                            qrCode: CriarTranferenciaCall.qRcode(
                              (_model.apiCall?.jsonBody ?? ''),
                            ),
                            pixPG: CriarTranferenciaCall.qRcode(
                              (_model.apiCall?.jsonBody ?? ''),
                            ),
                          ));
                          _model.saidaAlug = AlugueisRecord.getDocumentFromData(
                              createAlugueisRecordData(
                                titulo:
                                    'Pago ${dateTimeFormat("MMMM", getCurrentTimestamp)}  CPF:${valueOrDefault(currentUserDocument?.cpf, '')}',
                                valor: functions.trocarVirgulaCopy(
                                    _model.valorTextController.text),
                                nomeProprietario:
                                    _model.nomeDestinoTextController.text,
                                status: 'Aguardando aprovação',
                                isPago: false,
                                dono: currentUserReference,
                                pontos: (functions.removerNumeros(
                                        _model.valorTextController.text)!) +
                                    (functions
                                        .calcularpontos(FFAppState().valor)!),
                                dataPagamento: getCurrentTimestamp,
                                valorComAdd: FFAppState().valor / 100,
                                comprovante:
                                    _model.uploadedFileUrl_fotoComprovante,
                                idPagamento: CriarTranferenciaCall.idOrdem(
                                  (_model.apiCall?.jsonBody ?? ''),
                                ),
                                qrCode: CriarTranferenciaCall.qRcode(
                                  (_model.apiCall?.jsonBody ?? ''),
                                ),
                                pixPG: CriarTranferenciaCall.qRcode(
                                  (_model.apiCall?.jsonBody ?? ''),
                                ),
                              ),
                              alugueisRecordReference);

                          await _model.saidaAlug!.reference
                              .update(createAlugueisRecordData(
                            id: _model.saidaAlug?.reference.id,
                          ));

                          context.pushNamed(
                            QrCodeWidget.routeName,
                            queryParameters: {
                              'alugRef': serializeParam(
                                _model.saidaAlug?.reference,
                                ParamType.DocumentReference,
                              ),
                            }.withoutNulls,
                          );
                        } else {
                          await showDialog(
                            context: context,
                            builder: (alertDialogContext) {
                              return AlertDialog(
                                title: Text('Atenção!!!'),
                                content: Text('Fala na chamada.'),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.pop(alertDialogContext),
                                    child: Text('Ok'),
                                  ),
                                ],
                              );
                            },
                          );
                        }

                        safeSetState(() {});
                      },
                      text: 'Salvar',
                      options: FFButtonOptions(
                        width: double.infinity,
                        height: 70.0,
                        padding: EdgeInsetsDirectional.fromSTEB(
                            16.0, 0.0, 16.0, 0.0),
                        iconPadding:
                            EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 0.0, 0.0),
                        color: FlutterFlowTheme.of(context).primary,
                        textStyle:
                            FlutterFlowTheme.of(context).titleSmall.override(
                                  font: GoogleFonts.poppins(
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .titleSmall
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .titleSmall
                                        .fontStyle,
                                  ),
                                  color: Colors.white,
                                  fontSize: 18.0,
                                  letterSpacing: 0.0,
                                  fontWeight: FlutterFlowTheme.of(context)
                                      .titleSmall
                                      .fontWeight,
                                  fontStyle: FlutterFlowTheme.of(context)
                                      .titleSmall
                                      .fontStyle,
                                ),
                        elevation: 0.0,
                        borderRadius: BorderRadius.circular(16.0),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
